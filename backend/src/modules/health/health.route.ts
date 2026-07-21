import { Router } from "express";
import { databasehealthCheck, healthCheck } from "./health.controller";

const healthRoutes = Router();

healthRoutes.get("/health", healthCheck)
healthRoutes.get("/db", databasehealthCheck)

export default healthRoutes;