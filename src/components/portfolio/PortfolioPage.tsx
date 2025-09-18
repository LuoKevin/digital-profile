import { useState } from "react";
import ProjectCanvasDisplay from "./ProjectCanvasDisplay";
import ProjectListContainer from "./ProjectListContainer";
import { ProjectItem } from "../../models/ProjectItem";
import ProjectId from "../../models/ProjectId";


export const projects: Map<ProjectId, ProjectItem> = new Map<ProjectId, ProjectItem>([
    [ProjectId.DUMMY, new ProjectItem("Test Project", "This is a test project", null, null)]
    ,[ProjectId.SHUFFLER, new ProjectItem(
        "Attention Shuffler", 
        "Web application for taking attendance and shuffling students into randomized study groups.", 
        "https://yar8-attendance-app-ui.fly.dev/", 
        null
    )],
    [ProjectId.COLOR, new ProjectItem(
        "Color Calculator", 
        "Web application for calculating color schemes based on user input.", 
        "https://luokevin.github.io/color-calculator/", 
        null
    )],
    [ProjectId.PAINTER, new ProjectItem(
        "3D Model Painter", 
        "Personal projects with 3D printed model painting",
        "https://www.instagram.com/squibbinsquiddles/", 
        null
    )],
    [ProjectId.STL, new ProjectItem(
        "STL Viewer", 
        "Web application for viewing STL files in 3D.",
        "https://github.com/LuoKevin/stl-viewer", 
        null
    )]
]);

const PortfolioPage = () => {
    
    const dummyProject = new ProjectItem("Test Project", "This is a test project", null, null);

    const [selectedProject, setSelectedProject] = useState<ProjectItem>(dummyProject);
    return <div>
        <ProjectListContainer />
        <ProjectCanvasDisplay />
    </div>;
};

export default PortfolioPage;