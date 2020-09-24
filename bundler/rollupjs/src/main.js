import { version } from '../package.json'
import { count, increment } from './increment'

export default function main() {
  console.log('main.js with version', version)
  console.log('main.js', count)
  increment()
  console.log('main.js', count)
  // count += 1 // this is compile error
}
