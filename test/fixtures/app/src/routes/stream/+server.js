export function GET() {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first\n'));
        queueMicrotask(() => {
          controller.enqueue(new TextEncoder().encode('second\n'));
          controller.close();
        });
      }
    })
  );
}
