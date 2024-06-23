const handler = async (request) => {
  if (request.method === "POST") {
    const formData = await request.formData();
    const files = formData.getAll("files");
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Uint8Array(arrayBuffer);
      Deno.writeFileSync(`${dir}/${file.name}`, blob);
    }
    return new Response("OK", { status: 200 });
  } else {
    return new Response("Not Found", { status: 404 });
  }
};

const dir = "upload";

Deno.serve({
  port: 8000,
  cert: Deno.readTextFileSync("./ssl/localhost.pem"),
  key: Deno.readTextFileSync("./ssl/localhost-key.pem"),
}, handler);
