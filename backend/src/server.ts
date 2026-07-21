import "dotenv/config"
import app from "./app";

//PORT declaration
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Serving at http://localhost:${PORT}`);

})