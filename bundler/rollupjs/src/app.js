import helloworld from './hello-world'

function subtract(a, b) {
  return a - b
}

export const app = () => {
  console.log('app.js', helloworld)
  console.log(subtract(1, 2))

  import('./hello-world').then(({ default: result }) => {
    console.log(result)
  })
}
