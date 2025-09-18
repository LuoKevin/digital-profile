
interface ProjectListItemProps {
    // Define any props needed for the ProjectListItem component
    title: string
    description: string
    projectUrl: string | null
    imageUrl: string | null

}

const ProjectListItem: React.FC<ProjectListItemProps> = ({title, description, projectUrl, imageUrl}) => {
    return(<div>
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-gray-700 mb-4">Brief description of the project.</p>
                <a href="#" className="text-blue-500 hover:underline">View Project</a>
    </div>
    )
}

export default ProjectListItem;