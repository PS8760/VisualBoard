import { getDatabaseHealth, getHealthStatus } from "./health.service"
import { Request, Response } from "express";

export const healthCheck = (
    req:Request,
    res:Response
) => {
    res.status(200).json(
        getHealthStatus()
    );
};

export const databasehealthCheck = async (
    req:Request, 
    res:Response
) => {
    const result = await getDatabaseHealth();

    res.status(200).json(result); 
};