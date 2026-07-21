import prisma from "../../config/prisma"


export const getDatabaseHealth = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`
    return {
        success: true,
        database: "connected",
        timeStamp: new Date().toISOString()
    }
    } catch (error) {
        return {
            success: false,
            database: "disconnected",
            message: error
        }
    }

}

export const getHealthStatus = () => {
return {
    success: true,
    message: "Server is running",
    timeStamp: new Date().toISOString(),
}
}