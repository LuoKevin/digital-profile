import type { ProjectItem } from "../../models/ProjectItem";

interface ProjectCanvasDisplayProps {
    displayedProject: ProjectItem
}

const ProjectCanvasDisplay: React.FC<ProjectCanvasDisplayProps> = ({displayedProject}) => {
  return <div>ProjectCanvasDisplay</div>;
}

export default ProjectCanvasDisplay;