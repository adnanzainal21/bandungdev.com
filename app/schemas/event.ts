import { z } from "zod"
import { zfd } from "zod-form-data"

import { userId } from "~/schemas/general"

const organizerId = userId

const id = z.string({ required_error: "Event ID is required" })

// IDEA: Prepare trim slug function
const slug = z
  .string({ required_error: "Slug is required" })
  .min(1, "Slug require at least 1 character")
  .max(100, "Slug limited to 100 characters")

const title = z.string({ required_error: "Title is required" })

const description = z.string({ required_error: "Description is required" })

const content = z.string().optional()

const readingTime = zfd.numeric(z.number().min(0).max(1000)).optional()

export const schemaEvent = z.object({
  organizerId,
  id,
  slug,
  title,
  description,
  content,
  readingTime,
})

export const schemaEventDeleteAll = z.object({ organizerId })

export const schemaEventDeleteById = z.object({ organizerId, id })
