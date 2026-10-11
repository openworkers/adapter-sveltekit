import { read } from '$app/server';
import file from './message.txt?url';

export function GET() {
  return read(file);
}
