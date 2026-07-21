import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './modules/health/health.route';

//instance of express
const app = express();

//middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended:true }))
app.use("/api/v1", healthRoutes)
app.use("/api/v1", healthRoutes)
app.get("/", (req, res) => {
   res.json({
    success: true,
    message: "Visual WhiteBoard Backend is Running"
   })
})


export default app;
