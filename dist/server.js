"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const postgraphile_1 = require("./postgraphile");
const collect_1 = __importDefault(require("./routes/collect"));
const event_1 = __importDefault(require("./routes/event"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use('/', postgraphile_1.postgraphileMiddleware);
app.use(express_1.default.json());
app.use("/collect", collect_1.default);
app.use("/event", event_1.default);
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
app.get("/analytics.js", (req, res) => {
    const filePath = path_1.default.join(__dirname, "../public/analytics.js");
    res.setHeader("Content-Type", "application/javascript");
    fs_1.default.createReadStream(filePath).pipe(res);
});
app.listen(config_1.config.PORT, () => {
    console.log(`Server is running at http://localhost:${config_1.config.PORT}`);
    console.log(`GraphQL available at http://localhost:${config_1.config.PORT}/v1/api/putler-analytics-api`);
});
