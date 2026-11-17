import React from 'react';
import { StudioProvider, useStudio } from './context/StudioContext';
import { SidebarNav } from './components/SidebarNav';
import { TopStudioBar } from './components/TopStudioBar';
import { NewProjectWizardModal } from './components/NewProjectWizardModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ProjectDashboard } from './components/modules/ProjectDashboard';
import { TimelineModule } from './components/modules/TimelineModule';
import { FieldDesignerModule } from './components/modules/FieldDesignerModule';
import { QuizBuilderModule } from './components/modules/QuizBuilderModule';
import { BrandAndGraphicsModule } from './components/modules/BrandAndGraphicsModule';
import { AudioWorkspaceModule } from './components/modules/AudioWorkspaceModule';
import { AnimationPreviewModule } from './components/modules/AnimationPreviewModule';
import { ExportCenterModule } from './components/modules/ExportCenterModule';
import { PublishAndAssetsModule } from './components/modules/PublishAndAssetsModule';
import { ProjectManagerModule } from './components/modules/ProjectManagerModule';

function StudioWorkspaceShell() {
  const { activeModule } = useStudio();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#080E1A] text-slate-100 flex">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopStudioBar />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {activeModule === 'dashboard' && <ProjectDashboard />}
          {activeModule === 'timeline' && <TimelineModule />}
          {activeModule === 'field' && <FieldDesignerModule />}
          {activeModule === 'quiz' && <QuizBuilderModule />}
          {activeModule === 'graphics' && <BrandAndGraphicsModule />}
          {activeModule === 'audio' && <AudioWorkspaceModule />}
          {activeModule === 'preview' && <AnimationPreviewModule />}
          {activeModule === 'export' && <ExportCenterModule />}
          {activeModule === 'publish' && <PublishAndAssetsModule />}
          {activeModule === 'projects' && <ProjectManagerModule />}
        </main>
      </div>
      <NewProjectWizardModal />
      <CommandPaletteModal />
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <StudioWorkspaceShell />
    </StudioProvider>
  );
}
