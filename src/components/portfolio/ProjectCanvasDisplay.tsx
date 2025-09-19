import type { ProjectItem } from "../../models/ProjectItem";
import img from "../../../public/Timeline 2.gif";

interface ProjectCanvasDisplayProps {
    displayedProject: ProjectItem
}

const ProjectCanvasDisplay: React.FC<ProjectCanvasDisplayProps> = ({displayedProject}) => {

  return <div id="canvasContainer"
      data-grid="607"
				data-mouse="0.11"
				data-strength="0.36"
				data-relaxation="0.96"
      
     >
        <img src={img} alt="" />
      </div>
}

export default ProjectCanvasDisplay;