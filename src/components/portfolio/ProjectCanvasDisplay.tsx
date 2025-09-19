import type { ProjectItem } from "../../models/ProjectItem";
import brain from "../../../public/3.jpg";

interface ProjectCanvasDisplayProps {
    displayedProject: ProjectItem
}

const ProjectCanvasDisplay: React.FC<ProjectCanvasDisplayProps> = ({displayedProject}) => {

  return <div className="flex flex-col items-center justify-center">
    <img src={brain} alt="Windows" className="w-96 h-auto"/>
  </div>;
}

export default ProjectCanvasDisplay;