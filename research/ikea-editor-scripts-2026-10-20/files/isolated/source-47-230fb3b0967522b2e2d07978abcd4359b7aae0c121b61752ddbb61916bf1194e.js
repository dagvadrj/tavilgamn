
                    'use strict';

                    (function() {
                        let NewWorker = window.Worker
                        let allowSettingWorker = false

                        Object.defineProperty(window, 'Worker', {
                            set(value) {
                                // Only allow our code to override the global Worker object, preventing
                                // Akamai from hijacking our Worker and causing various issues.
                                if (!allowSettingWorker) {
                                    return
                                }
                                NewWorker = value
                            },
                            get() {
                                return NewWorker
                            },
                            configurable: false,
                        })

                        window.overrideWorker = (value) => {
                            allowSettingWorker = true
                            window.Worker = value
                            allowSettingWorker = false
                        }
                    })()
                