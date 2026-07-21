import { createBrowserRouter } from "react-router-dom";


export const router = createBrowserRouter([
    {
        path: "/",
        element: <h1>Home Page</h1>
    },
    {
        path: "/login",
        element: <h1>Login Page</h1>
    },
    {
        path: "/register",
        element: <h1>Register Page</h1>
    },
    {
        path: "/board/:id",
        element: <h1>Board Pagee</h1>
    }
]);
