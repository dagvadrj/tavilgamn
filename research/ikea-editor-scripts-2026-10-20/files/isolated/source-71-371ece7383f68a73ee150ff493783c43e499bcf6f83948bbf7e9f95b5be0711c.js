
            const stateUpdateCallbacks = Symbol('stateUpdateCallbacks')
            window[stateUpdateCallbacks] = {}
            const states = Symbol('states')
            window[states] = {}

            window.onStateChange = (namespace, callback) => {
                const currentState = window[states][namespace]
                if (currentState !== undefined) {
                    callback(currentState)
                }
                window[stateUpdateCallbacks][namespace] = window[stateUpdateCallbacks][namespace] || []
                window[stateUpdateCallbacks][namespace].push(callback)
            }

            window.setState = (namespace, state) => {
                const callbacks = window[stateUpdateCallbacks][namespace] ?? []
                for (const callback of callbacks) {
                    callback(state)
                }
                window[states][namespace] = state
            }
        