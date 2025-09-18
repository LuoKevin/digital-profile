import ProjectId from "./ProjectId"

export class ProjectItem {
    projectId: ProjectId = ProjectId.DUMMY
    title: string
    description: string
    projectUrl: string | null
    imageUrl: string | null
    
    constructor(title: string, description: string, projectUrl: string | null, imageUrl: string | null) {
        this.title = title
        this.description = description
        this.projectUrl = projectUrl
        this.imageUrl = imageUrl
    }
}

