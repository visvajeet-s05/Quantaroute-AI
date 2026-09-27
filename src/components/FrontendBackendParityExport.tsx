import React, { useState, useMemo } from 'react';
import { Download, Copy, CheckCircle2, XCircle, AlertCircle, FileJson, Clipboard, Loader2 } from 'lucide-react';
import { ExperimentRecord, InitialRoutingExperimentRecord } from '../types/experiments';
import { Scenario } from '../types/domain';
import { RoutePlan } from '../types/routing';
import type { FrontendBackendParityExport as ParityExportData, ParityExportValidationResult } from '../types/parity';
import {
  buildParityExport,
  validateParityExportLocally,
  generateParityFilename,
  downloadParityExport,
  copyParityExport,
} from '../utils/frontendParityExport';
import { FrontendParityMetadata } from '../types/parity';

interface FrontendBackendParityExportProps {
  history: ExperimentRecord[];
  scenario: Scenario | null;
  selectedRecord: InitialRoutingExperimentRecord | null;
  onSelectRecord?: (record: InitialRoutingExperimentRecord) => void;
  onClose?: () => void;
}

export const FrontendBackendParityExport: React.FC<FrontendBackendParityExportProps> = ({
  history,
  scenario,
  selectedRecord,
  onSelectRecord,
  onClose,
}) => {
  const [internalRecordId, setInternalRecordId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ParityExportValidationResult | null>(null);
  const [exportData, setExportData] = useState<ParityExportData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Filter initial routing records that have route plans
  const availableRecords = useMemo(() => {
    return history.filter((r): r is InitialRoutingExperimentRecord => 
      r.runType === 'initial_routing' && r.routePlan !== undefined && r.feasible !== undefined
    );
  }, [history]);

  const activeRecord = useMemo(() => {
    if (internalRecordId) {
      const found = availableRecords.find(r => r.id === internalRecordId);
      if (found) return found;
    }
    if (selectedRecord && availableRecords.some(r => r.id === selectedRecord.id)) {
      return selectedRecord;
    }
    return availableRecords.length > 0 ? availableRecords[availableRecords.length - 1] : null;
  }, [availableRecords, internalRecordId, selectedRecord]);

  // Determine if we can build export from selected record
  const canExport = !!(activeRecord && scenario);
  const missingReason = useMemo(() => {
    if (!scenario) return 'No scenario loaded';
    if (!activeRecord) return 'No experiment record available';
    if (activeRecord.runType !== 'initial_routing') return 'Only initial routing records supported';
    if (!activeRecord.routePlan) return 'Selected record has no RoutePlan';
    return null;
  }, [scenario, activeRecord]);

  const handleValidate = () => {
    if (!canExport || !activeRecord || !scenario) return;
    
    setIsValidating(true);
    setBuildError(null);
    
    // Build export first, then validate
    const result = buildParityExport({
      experimentRecord: activeRecord,
      scenario,
      appVersion: '1.0.0',
    });
    
    if ('error' in result) {
      setBuildError(result.error);
      setValidationResult({ passed: false, checks: [{ name: 'Build export', passed: false, message: result.error }] });
      setExportData(null);
    } else {
      const validation = validateParityExportLocally(result);
      setValidationResult(validation);
      setExportData(result);
      setBuildError(null);
    }
    
    setIsValidating(false);
  };

  const handleDownload = () => {
    if (!exportData || !activeRecord) return;
    
    setDownloaded(true);
    const filename = generateParityFilename(
      activeRecord.algorithm,
      activeRecord.scenarioSeed
    );
    downloadParityExport(exportData, filename);
    
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopy = async () => {
    if (!exportData) return;
    
    setCopied(true);
    await copyParityExport(exportData);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAlgorithmColor = (algorithm: string) => {
    switch (algorithm) {
      case 'greedy': return 'text-sky-600 bg-sky-100';
      case 'pso': return 'text-indigo-600 bg-indigo-100';
      case 'qpso': return 'text-teal-600 bg-teal-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getAlgorithmIcon = (algorithm: string) => {
    switch (algorithm) {
      case 'greedy': return <FileJson className="w-4 h-4" />;
      case 'pso': return <Clipboard className="w-4 h-4" />;
      case 'qpso': return <FileJson className="w-4 h-4" />;
      default: return <FileJson className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Frontend/Backend Parity Export</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate genuine frontend export for backend metric parity verification
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Export Status / Missing Requirements */}
      <div className={`p-3 rounded-lg border ${
        canExport 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
          : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}>
        <div className="flex items-center gap-2">
          {canExport ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span className="font-medium text-xs">
            {canExport 
              ? 'Ready to export' 
              : `Export unavailable: ${missingReason}`}
          </span>
        </div>
        {canExport && activeRecord && (
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600">
            <span className={`px-2 py-0.5 rounded ${getAlgorithmColor(activeRecord.algorithm)}`}>
              {activeRecord.algorithmLabel}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Seed: {activeRecord.scenarioSeed}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {activeRecord.optimizerPreset}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {activeRecord.feasible ? 'Feasible' : 'Infeasible'}
            </span>
          </div>
        )}
      </div>

      {/* Available Records */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Select Completed Initial Routing Result
        </h3>
        {availableRecords.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-500">
            No completed initial routing experiments available.
            <br />
            Run Greedy, Classical PSO, or QPSO first.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableRecords.map((record) => (
              <button
                key={record.id}
                onClick={() => {
                  setInternalRecordId(record.id);
                  onSelectRecord?.(record);
                }}
                className={`p-3 rounded-lg border-2 text-left text-xs transition-all ${
                  activeRecord?.id === record.id
                    ? 'border-cyan-500 bg-cyan-50 shadow-sm ring-1 ring-cyan-400'
                    : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${getAlgorithmColor(record.algorithm)}`}>
                    {getAlgorithmIcon(record.algorithm)}
                    {record.algorithmLabel}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    record.feasible 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {record.feasible ? 'Feasible' : 'Infeasible'}
                  </span>
                </div>
                <div className="space-y-0.5 text-[10px] text-slate-500">
                  <div>Preset: {record.optimizerPreset}</div>
                  <div>Seed: {record.scenarioSeed}</div>
                  <div>Score: {record.routingScore.toFixed(2)}</div>
                  <div>Assigned: {record.customersAssigned} / {record.customerCount}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {canExport && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleValidate}
              disabled={isValidating || isBuilding}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Validate Export Locally
                </>
              )}
            </button>
            
            <button
              onClick={handleDownload}
              disabled={isBuilding || !exportData || isValidating}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {isBuilding ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Building...
                </>
              ) : downloaded ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  Download Parity JSON
                </>
              )}
            </button>

            <button
              onClick={handleCopy}
              disabled={!exportData || isValidating}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy JSON
                </>
              )}
            </button>
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className={`p-3 rounded-lg border ${
              validationResult.passed 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-rose-50 border-rose-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <span className="font-medium text-xs">
                  {validationResult.passed 
                    ? 'All validation checks passed' 
                    : 'Some validation checks failed'}
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                {validationResult.checks.map((check, idx) => (
                  <div key={idx} className={`flex items-center gap-1.5 ${check.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                    <span className={check.passed ? 'text-emerald-600' : 'text-rose-600'}>
                      {check.passed ? '✓' : '✗'}
                    </span>
                    <span className="font-medium">{check.name}</span>
                    {check.message && (
                      <span className="text-slate-500">— {check.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Build Error */}
          {buildError && !validationResult && (
            <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3 h-3 text-rose-600" />
                <span className="font-medium">Export Build Failed</span>
              </div>
              <div>{buildError}</div>
            </div>
          )}

          {/* Export Preview (when built) */}
          {exportData && (
            <details className="border border-slate-200 rounded-lg overflow-hidden">
              <summary className="p-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600 cursor-pointer">
                Export Preview (click to expand)
              </summary>
              <div className="p-2 max-h-64 overflow-auto">
                <pre className="text-[9px] text-slate-700 font-mono whitespace-pre-wrap">
                  {JSON.stringify(exportData, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
        <div className="font-medium text-slate-800">Instructions</div>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Run Greedy/PSO/QPSO on Normal Traffic (seed 26137)</li>
          <li>Select completed result from the grid above</li>
          <li>Click "Validate Export Locally" — confirm all checks pass</li>
          <li>Click "Download Parity JSON" to save the file</li>
          <li>Upload/paste into backend Swagger: <code className="bg-white px-1 rounded">POST /api/v1/parity/compare</code></li>
          <li>Confirm: <code className="bg-white px-1 rounded">sourceVerified: true, passed: true, mismatches: []</code></li>
        </ol>
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
          <strong>Rule:</strong> Never edit frontend evaluation values to force parity. 
          Fix implementation or data-contract mismatches instead.
        </div>
      </div>
    </div>
  );
};