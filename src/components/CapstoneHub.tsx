/**
 * Capstone Hub — Tab organizer for all capstone presentation components.
 * Keeps the main dashboard clean while providing access to all capstone features.
 */

import React, { useState, useMemo } from 'react';
import { GuidedCapstoneDemo } from './GuidedCapstoneDemo';
import { MethodologyPanel } from './MethodologyPanel';
import { ResultsPanel } from './ResultsPanel';
import { ScreenshotChecklist } from './ScreenshotChecklist';
import { FinalReadinessPanel } from './FinalReadinessPanel';
import { ProjectDocumentationView } from './ProjectDocumentationView';
import { ExperimentHistory } from './ExperimentHistory';
import { FrontendBackendParityExport } from './FrontendBackendParityExport';
import { loadExperimentHistory } from '../utils/experimentStorage';
import { ExperimentHistory as ExperimentHistoryType, ExperimentRecord } from '../types/experiments';
import { Scenario } from '../types/domain';
import { runCapstonePresentationTests } from '../utils/capstonePresentationValidationTests';
import {
  LayoutDashboard,
  Target,
  BarChart3,
  ClipboardCheck,
  Package,
  BookOpen,
  History,
  FileJson,
} from 'lucide-react';

interface CapstoneHubProps {
  scenarioSeed?: number;
  onOpenValidation: () => void;
  scenario?: Scenario;
  experimentHistory?: ExperimentRecord[];
  selectedExperimentRecord?: ExperimentRecord | null;
  onSelectRecord?: (record: ExperimentRecord) => void;
}

type TabId = 'guided' | 'methodology' | 'results' | 'documentation' | 'evidence' | 'readiness' | 'history' | 'parity';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'guided', label: 'Guided Demo', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'methodology', label: 'Methodology', icon: <Target className="w-4 h-4" /> },
  { id: 'results', label: 'Results', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'documentation', label: 'Documentation', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'evidence', label: 'Evidence Checklist', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'readiness', label: 'Final Readiness', icon: <Package className="w-4 h-4" /> },
  { id: 'history', label: 'Experiment History', icon: <History className="w-4 h-4" /> },
  { id: 'parity', label: 'Parity Export', icon: <FileJson className="w-4 h-4" /> },
];

export const CapstoneHub: React.FC<CapstoneHubProps> = ({ 
  onOpenValidation, 
  scenario, 
  experimentHistory = [],
  selectedExperimentRecord = null,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('guided');
  const [history, setHistory] = useState<ExperimentHistoryType>([]);

  const refreshHistory = () => {
    const loaded = loadExperimentHistory();
    if (loaded.ok) setHistory(loaded.history);
  };

  const handleRecordsAdded = () => {
    refreshHistory();
  };

  const capstoneTestResults = useMemo(() => {
    return runCapstonePresentationTests();
  }, []);

  const allCapstoneTestsPassed = capstoneTestResults.every((t) => t.passed);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div>
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">
          Capstone Presentation Hub
        </h2>
        <div className="border-b border-slate-200">
          <nav className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`}
                role="tab"
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-[400px]">
        {activeTab === 'guided' && (
          <GuidedCapstoneDemo
            onOpenResults={() => {
              setActiveTab('results');
              refreshHistory();
            }}
            onOpenValidation={onOpenValidation}
          />
        )}

        {activeTab === 'methodology' && <MethodologyPanel />}

        {activeTab === 'results' && (
          <ResultsPanel
            history={history}
            onSelectRecord={onSelectRecord}
          />
        )}

        {activeTab === 'documentation' && <ProjectDocumentationView />}

        {activeTab === 'evidence' && <ScreenshotChecklist />}

        {activeTab === 'readiness' && <FinalReadinessPanel />}

        {activeTab === 'history' && (
          <ExperimentHistory
            history={history}
            onClearHistory={handleRecordsAdded}
          />
        )}

        {activeTab === 'parity' && scenario && (
          <FrontendBackendParityExport
            history={experimentHistory}
            scenario={scenario}
            selectedRecord={selectedExperimentRecord as any}
          />
        )}
      </div>

      {/* Capstone Test Summary */}
      <div
        className={`border rounded-xl p-3 text-xs ${
          allCapstoneTestsPassed
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        <div className="font-semibold flex items-center gap-1.5">
          {allCapstoneTestsPassed ? 'All Capstone Presentation Checks passed' : 'Some Capstone Presentation Checks failed'}
        </div>
        <div className="mt-1 space-y-0.5">
          {capstoneTestResults.map((t) => (
            <div key={t.id} className="flex items-center justify-between">
              <span>{t.name}</span>
              <span>{t.passed ? 'PASS' : 'FAIL'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
