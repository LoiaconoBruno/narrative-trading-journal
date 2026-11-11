// La llamada a la API de Claude con el SDK oficial. La key llega por la variable de
// entorno ANTHROPIC_API_KEY, que en GitHub Actions sale de los secretos del repo.
// Se usa streaming porque las respuestas pueden ser largas (el SDK junta el mensaje final).
import Anthropic from "@anthropic-ai/sdk";

export function crearLlamador() {
  const cliente = new Anthropic({ maxRetries: 3 });
  return (pedido) => cliente.beta.messages.stream(pedido).finalMessage();
}
