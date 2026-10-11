export interface Project {
  id: number
  name: string
  created_at: string
}

export interface Inspiration {
  id: number
  project_id: number
  raw_text: string
  cleaned_text: string
  created_at: string
}
