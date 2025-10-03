import type ProjectId from "../../models/ProjectId";
import ProjectListItem from "./ProjectListItem";        
import type { ProjectItem } from "../../models/ProjectItem";

interface ProjectListContainerProps {
    projects: Map<ProjectId, ProjectItem>
    setActiveProject: (projectId: ProjectId) => void;
}

const ProjectListContainer: React.FC<ProjectListContainerProps> = ({projects, setActiveProject}) => {
    return (<div className="">
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...projects.values()].map((project) => (
                <li  onClick={() => {}} key={project.projectId} className="bg-white p-4 rounded-lg shadow-md">
                   <ProjectListItem title={project.title} description={project.description} projectUrl={project.projectUrl} imageUrl={project.imageUrl}/>
                </li>
            ))}
            {/* Add more ProjectListItem components as needed */}
        </ul>
    </div>)
}

export default ProjectListContainer;