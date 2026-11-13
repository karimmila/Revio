// Only the signed-in desktop app registers Orca cloud services; headless hosts refuse them by name (#33593).
import { FORK_PRODUCT_NAME } from './fork-identity'
export const SHARING_UNAVAILABLE_ON_HOST_CODE = 'sharing_unavailable_on_host' as const

export const SHARING_UNAVAILABLE_ON_HOST_MESSAGE = `${FORK_PRODUCT_NAME} cloud features like sharing aren't available on headless ${FORK_PRODUCT_NAME} servers yet. Use the ${FORK_PRODUCT_NAME} desktop app for this.`

export const SHARING_UNAVAILABLE_ON_HOST_NEXT_STEPS: readonly string[] = [
  `Open the ${FORK_PRODUCT_NAME} desktop app, sign in, and run the command from a ${FORK_PRODUCT_NAME} terminal there.`
]

export class SharingUnavailableOnHostError extends Error {
  readonly code = SHARING_UNAVAILABLE_ON_HOST_CODE
  readonly data = { nextSteps: [...SHARING_UNAVAILABLE_ON_HOST_NEXT_STEPS] }

  constructor() {
    super(SHARING_UNAVAILABLE_ON_HOST_MESSAGE)
    this.name = 'SharingUnavailableOnHostError'
  }
}
