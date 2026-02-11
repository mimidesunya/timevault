import React, { useState } from "preact/compat"
import { h } from "preact"
import { Tab, TabView } from "./components/TabView"
import { TextEncrypt } from "./views/TextEncrypt"
import { MultiDecrypt } from "./views/MultiDecrypt"

export type Network = "quicknet"

const App = () => {
    const networkURL: Network = "quicknet"
    return (
        <div>
            <TabView>
                <Tab title={"作成 (Encrypt)"}>
                    <TextEncrypt network={networkURL} />
                </Tab>
                <Tab title={"復元 (Decrypt)"}>
                    <MultiDecrypt network={networkURL} />
                </Tab>
            </TabView>
        </div>
    )
}

export { App }
