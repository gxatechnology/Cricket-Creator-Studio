import React from 'react';
import { useStudio } from '../context/StudioContext';
import { SidebarNav } from './SidebarNav';
import { TopStudioBar } from './TopStudioBar';
import { ProjectDashboard } from './modules/ProjectDashboard';
import { TimelineModule } from './modules/TimelineModule';
import { FieldDesignerModule } from './modules/FieldDesignerModule';
import { QuizBuilderModule } from './modules/QuizBuilderModule';
import { BrandAndGraphicsModule } from './modules/BrandAndGraphicsModule';
import { AudioWorkspaceModule } from './modules/AudioWorkspaceModule';
import { AnimationPreviewModule } from './modules/AnimationPreviewModule';
import { ExportCenterModule } from './modules/ExportCenterModule';
import { PublishAndAssetsModule } from './modules/PublishAndAssetsModule';
import { ProjectManagerModule } from './modules/ProjectManagerModule';

export default function StudioWorkspaceShell() {
  const { activeModule } = useStudio();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#080E1A] text-slate-100 flex flex-col md:flex-row">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopStudioBar />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {activeModule === 'dashboard' && <ProjectDashboard />}
          {activeModule === 'quiz' && <QuizBuilderModule />}
          {activeModule === 'field' && <FieldDesignerModule />}
          {activeModule === 'preview' && <AnimationPreviewModule />}
          {activeModule === 'timeline' && <TimelineModule />}
          {activeModule === 'graphics' && <BrandAndGraphicsModule />}
          {activeModule === 'audio' && <AudioWorkspaceModule />}
          {activeModule === 'export' && <ExportCenterModule />}
          {activeModule === 'publish' && <PublishAndAssetsModule />}
          {activeModule === 'projects' && <ProjectManagerModule />}
        </main>
      </div>
    </div>
  );
}
