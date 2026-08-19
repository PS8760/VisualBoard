import { Router } from 'express';
import { healthCheck, readinessCheck } from './health.controller.js';

const healthRoutes = Router();

healthRoutes.get('/health', healthCheck);
healthRoutes.get('/health/ready', readinessCheck);

export default healthRoutes;