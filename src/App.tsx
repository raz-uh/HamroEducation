import { useState } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CurriculumWorkspace } from './components/CurriculumWorkspace.tsx';
import { InstitutionsView } from './components/InstitutionsView.tsx';
import { RbacGovernanceView } from './components/RbacGovernanceView.tsx';
import { SchemaBlueprintView } from './components/SchemaBlueprintView.tsx';
import { TopBar, type WorkspaceTab } from './components/TopBar.tsx';

function WorkspaceShell() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('curriculum');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-6">
        {activeTab === 'curriculum' && (
          <CurriculumWorkspace onOpenAuth={() => setAuthModalOpen(true)} />
        )}
        {activeTab === 'rbac' && (
          <RbacGovernanceView onOpenAuth={() => setAuthModalOpen(true)} />
        )}
        {activeTab === 'institutions' && <InstitutionsView />}
        {activeTab === 'schema' && <SchemaBlueprintView />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Hamro Education · Nepal-first Digital Learning Ecosystem</span>
          <span>Country-Aware PostgreSQL Schema &amp; Server-Side RBAC</span>
        </div>
      </footer>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}
