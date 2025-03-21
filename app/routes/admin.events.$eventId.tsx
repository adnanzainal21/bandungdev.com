import { conform, useForm, useInputEvent } from "@conform-to/react"
import { getFieldsetConstraint, parse } from "@conform-to/zod"
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node"
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react"
import { useRef, useState } from "react"
import { z } from "zod"
import { EditorTiptapHook } from "~/components/libs/editor-tiptap"
import { FormChangeStatus } from "~/components/shared/form-change-status"
import { FormDelete } from "~/components/shared/form-delete"
import { ButtonLink } from "~/components/ui/button-link"
import { ButtonLoading } from "~/components/ui/button-loading"
import { FormErrors } from "~/components/ui/form"

import { Timestamp } from "~/components/shared/timestamp"
import { Button } from "~/components/ui/button"
import { Iconify } from "~/components/ui/iconify"
import { Separator } from "~/components/ui/separator"
import { TextareaAutosize } from "~/components/ui/textarea-autosize"
import { requireUser } from "~/helpers/auth"
import { useAppAdminLoaderData } from "~/hooks/use-app-loader-data"
import { prisma } from "~/libs/db.server"
import { modelAdminEvent } from "~/models/admin-event.server"
import { schemaEvent } from "~/schemas/event"
import { invariant, invariantResponse } from "~/utils/invariant"
import { createMeta } from "~/utils/meta"
import { createSitemap } from "~/utils/sitemap"
import { createSlug, truncateText } from "~/utils/string"
import { createTimer } from "~/utils/timer"

export const handle = createSitemap()

export const meta: MetaFunction<typeof loader> = ({ params, data }) => {
  const event = data?.event

  if (!event) {
    return createMeta({
      title: "Event not found",
      description: `Cannot find event with slug ${params.eventSlug}`,
    })
  }
  return createMeta({
    title: event.title,
    description: event.description,
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  invariant(params.eventId, "params.eventId unavailable")
  const { userId: organizerId } = await requireUser(request)
  const event = await modelAdminEvent.getById({
    organizerId,
    id: params.eventId,
  })
  invariantResponse(event, "Event not found", { status: 404 })
  return json({ event })
}

export default function UserEventsEventIdRoute() {
  const { event } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const { eventStatuses } = useAppAdminLoaderData()

  const [form, { organizerId, id, slug, title, description, content }] =
    useForm<z.infer<typeof schemaEvent>>({
      id: "update-event",
      lastSubmission: actionData?.submission,
      shouldRevalidate: "onInput",
      constraint: getFieldsetConstraint(schemaEvent),
      onValidate({ formData }) {
        return parse(formData, { schema: schemaEvent })
      },
      defaultValue: { ...event, organizerId: event.organizerId },
    })

  const isSubmitting = navigation.state === "submitting"
  const isEventUpdated = event.createdAt !== event.updatedAt
  const isEventDraft = event.status.symbol === "DRAFT"
  const isEventPublished = !isEventDraft

  const [titleValue, setTitleValue] = useState(title.defaultValue ?? "")
  const slugRef = useRef<HTMLInputElement>(null)
  const slugControl = useInputEvent({ ref: slugRef })

  const [contentValue, setContentValue] = useState(content.defaultValue ?? "")
  const contentRef = useRef<HTMLInputElement>(null)
  const contentControl = useInputEvent({ ref: contentRef })

  function handleReset() {
    form.ref.current?.reset()
    setTitleValue(event.title)
    setContentValue(event.content ?? "")
  }

  function handleUpdateSlug() {
    const newSlug = createSlug(titleValue)
    slugControl.change(newSlug)
  }

  function handleUpdateContent(htmlString: string) {
    contentControl.change(htmlString)
  }

  if (!event) return null

  return (
    <div className="app-container">
      <Form replace method="POST" {...form.props}>
        <fieldset className="space-y-8" disabled={isSubmitting}>
          <section className="app-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ButtonLoading
                  variant="outline"
                  size="xs"
                  loadingText="Saving"
                  isLoading={isSubmitting}
                  iconComponent={<Iconify icon="ph:floppy-disk-duotone" />}
                >
                  <span>Save</span>
                </ButtonLoading>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleReset}
                >
                  <Iconify icon="ph:arrow-counter-clockwise" />
                  <span>Reset</span>
                </Button>
                <FormDelete
                  action="/admin/events/delete"
                  intentValue="user-delete-event-by-id"
                  itemText={`a event: ${truncateText(event.title)} (${
                    event.slug
                  })`}
                  defaultValue={event.id}
                  requireUser
                  userId={event.organizerId}
                />
                <ButtonLink
                  variant="outline"
                  size="xs"
                  to={`/events/${event.slug}`}
                  disabled={isEventDraft}
                >
                  <Iconify icon="ph:arrow-square-out-duotone" />
                  <span>View</span>
                </ButtonLink>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ButtonLoading
                  type="button"
                  variant="outline"
                  size="xs"
                  loadingText="Publishing"
                  isLoading={isSubmitting}
                  iconComponent={
                    <Iconify
                      icon={
                        isEventPublished
                          ? "ph:book-open-duotone"
                          : "ph:book-open-text-duotone"
                      }
                    />
                  }
                >
                  <span>{isEventPublished ? "Unpublish" : "Publish"}</span>
                </ButtonLoading>

                <FormChangeStatus
                  itemId="eventId"
                  action="/admin/events/patch"
                  intentValue="change-event-status"
                  dialogTitle="Change event's status"
                  dialogDescription={`Change the status of event: ${event.title} (${event.slug})`}
                  itemStatuses={eventStatuses}
                  item={event as any}
                />
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-prose space-y-4">
            <input type="hidden" {...conform.input(organizerId)} />
            <input type="hidden" {...conform.input(id)} />

            <div className="text-xs text-muted-foreground">
              <Timestamp
                isUpdated={isEventUpdated}
                createdAt={event.createdAt}
                updatedAt={event.updatedAt}
              />
            </div>

            <div>
              <div className="flex justify-between gap-2">
                <input
                  {...conform.input(slug)}
                  ref={slugRef}
                  placeholder="untitled"
                  spellCheck="false"
                  className="input-natural flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleUpdateSlug}
                >
                  <Iconify icon="ph:lightbulb-duotone" />
                  <span>Generate Slug</span>
                </Button>
              </div>
              <FormErrors>{slug}</FormErrors>
            </div>

            <div>
              <TextareaAutosize
                name={title.name}
                minRows={1}
                defaultValue={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                placeholder="Untitled"
                spellCheck="false"
                className="input-natural w-full resize-none text-4xl font-semibold"
              />
              <FormErrors>{title}</FormErrors>
            </div>

            <div>
              <TextareaAutosize
                name={description.name}
                defaultValue={description.defaultValue}
                minRows={1}
                placeholder="Untitled"
                spellCheck="false"
                className="input-natural w-full resize-none text-xl"
              />
              <FormErrors>{description}</FormErrors>
            </div>

            <Separator className="my-4" />

            <div>
              <FormErrors>{content}</FormErrors>
              <input
                {...conform.input(content, { hidden: true })}
                ref={contentRef}
                onChange={e => setContentValue(e.target.value)}
              />
              <EditorTiptapHook
                content={contentValue}
                handleUpdate={handleUpdateContent}
                placeholderText="Write the content detail about the event..."
              />
            </div>

            {/* Manual textarea editor */}
            <div className="hidden">
              <textarea
                placeholder="Add some content..."
                spellCheck="false"
                cols={30}
                rows={20}
                className="input-natural resize-none"
              />
            </div>
          </section>
        </fieldset>
      </Form>
    </div>
  )
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const timer = createTimer()
  const clonedRequest = request.clone()
  const formData = await clonedRequest.formData()

  const submission = await parse(formData, {
    async: true,
    schema: schemaEvent.superRefine(async (data, ctx) => {
      const { id, slug } = data
      const existingSlug = await prisma.event.findUnique({
        where: { slug, NOT: { id } },
        select: { id: true },
      })
      if (existingSlug) {
        ctx.addIssue({
          path: ["slug"],
          code: z.ZodIssueCode.custom,
          message: "Slug cannot be used, please change",
        })
        return
      }
    }),
  })

  if (!submission.value || submission.intent !== "submit") {
    await timer.delay()
    return json({ status: "error", submission }, { status: 400 })
  }

  const event = await modelAdminEvent.update(submission.value)

  await timer.delay()
  return redirect(`/admin/events/${event.id}`)
}
