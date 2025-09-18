import ProjectListItem from "./ProjectListItem";


const ProjectListContainer = () => {
    return (<div className="">
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Map through your projects and render ProjectListItem components here */}
            <li className="bg-white p-4 rounded-lg shadow-md">
               <ProjectListItem title="Project Title" description="Brief description of the project." projectUrl={null} imageUrl={null}/>
            </li>
            {/* Add more ProjectListItem components as needed */}
        </ul>
    </div>)
}

export default ProjectListContainer;