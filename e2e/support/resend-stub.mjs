// A local stand-in for Resend's POST /emails (the API reaches it through RESEND_API_URL), so specs
// never send mail. Specs read what arrived with GET /sent and make the next sends fail with
// PUT /mode {"status": 500}.
import { createServer } from "node:http";

const port = Number(process.env.RESEND_STUB_PORT ?? 8102);
let sent = [];
let status = 200;

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const reply = (response, code, body) => {
  response.writeHead(code, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  const { method, url } = request;
  if (method === "POST" && url === "/emails") {
    const body = JSON.parse(await readBody(request));
    if (status !== 200) return reply(response, status, { message: "stubbed failure" });
    sent.push({ authorization: request.headers.authorization, ...body });
    return reply(response, 200, { id: `stub-${sent.length}` });
  }
  if (method === "GET" && url === "/sent") return reply(response, 200, sent);
  if (method === "DELETE" && url === "/sent") {
    sent = [];
    status = 200;
    return reply(response, 200, {});
  }
  if (method === "PUT" && url === "/mode") {
    status = JSON.parse(await readBody(request)).status;
    return reply(response, 200, {});
  }
  reply(response, 404, {});
}).listen(port, () => console.log(`Resend stub on ${port}`));
