import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreatePersonReportDeliveryInputSchema,
  PersonReportDeliveriesOutputSchema,
  PersonReportDeliveryOutputSchema,
  PersonReportDocumentOutputSchema,
  PersonReportOutputSchema,
  PersonReportParamsSchema,
  PersonReportQuerySchema,
  PersonReportScheduleStateOutputSchema,
  UpdatePersonReportScheduleInputSchema,
} from "@openmonetis/validators/person-reports";
import type { PersonReportsService } from "../services/person-reports.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const ReportSchema = z.object({ data: PersonReportOutputSchema, error: z.null() });
const DeliveriesSchema = z.object({ data: PersonReportDeliveriesOutputSchema, error: z.null() });
const DeliverySchema = z.object({ data: PersonReportDeliveryOutputSchema, error: z.null() });
const DocumentSchema = z.object({ data: PersonReportDocumentOutputSchema, error: z.null() });
const ScheduleSchema = z.object({ data: PersonReportScheduleStateOutputSchema, error: z.null() });

export function createPersonReportsRoute(service: PersonReportsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/{personId}",
      tags: ["Person reports"],
      request: { params: PersonReportParamsSchema, query: PersonReportQuerySchema },
      responses: {
        200: {
          description: "Get the monthly expense report of an external person",
          content: { "application/json": { schema: ReportSchema } },
        },
        400: error("Invalid period or person is not external"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.getReport(
            c.req.valid("param").personId,
            c.get("userId"),
            c.req.valid("query").period,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{personId}/document",
      tags: ["Person reports"],
      request: { params: PersonReportParamsSchema, query: PersonReportQuerySchema },
      responses: {
        200: {
          description: "Get the emailed statement as a printable page, to save as PDF",
          content: { "application/json": { schema: DocumentSchema } },
        },
        400: error("Invalid period or person is not external"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.getReportDocument(
            c.req.valid("param").personId,
            c.get("userId"),
            c.req.valid("query").period,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{personId}/deliveries",
      tags: ["Person reports"],
      request: { params: PersonReportParamsSchema },
      responses: {
        200: {
          description: "List the latest email deliveries of a person's report",
          content: { "application/json": { schema: DeliveriesSchema } },
        },
        400: error("Person is not external"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(ok(await service.listDeliveries(c.req.valid("param").personId, c.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{personId}/deliveries",
      tags: ["Person reports"],
      request: {
        params: PersonReportParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreatePersonReportDeliveryInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Email the monthly report to the person",
          content: { "application/json": { schema: DeliverySchema } },
        },
        400: error("Invalid input, or the person cannot receive the report"),
        401: error("Authentication required"),
        404: error("Person not found"),
        429: error("Too many deliveries"),
        503: error("Email delivery is not configured or failed"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.sendReport(
            c.req.valid("param").personId,
            c.get("userId"),
            c.req.valid("json"),
          ),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{personId}/schedule",
      tags: ["Person reports"],
      request: { params: PersonReportParamsSchema },
      responses: {
        200: {
          description: "Get the automatic email schedule of a person's report",
          content: { "application/json": { schema: ScheduleSchema } },
        },
        400: error("Person is not external"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(ok(await service.getSchedule(c.req.valid("param").personId, c.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/{personId}/schedule",
      tags: ["Person reports"],
      request: {
        params: PersonReportParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdatePersonReportScheduleInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Save the automatic email schedule of a person's report",
          content: { "application/json": { schema: ScheduleSchema } },
        },
        400: error("Invalid schedule, or the person cannot receive the report"),
        401: error("Authentication required"),
        404: error("Person not found"),
        429: error("Too many changes"),
        503: error("Email delivery is not configured"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.updateSchedule(
            c.req.valid("param").personId,
            c.get("userId"),
            c.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  return route;
}
