import React, { useState } from "preact/compat"
import { h } from "preact"
import { Tab, TabView } from "./components/TabView"
import { FileEncrypt } from "./views/FileEncrypt"
import { FileDecrypt } from "./views/FileDecrypt"
import { FileShare } from "./views/FileShare"
import { HealthView } from "./views/HealthView"
import { VaultList } from "./components/VaultList"

export type Network = "quicknet"

const App = () => {
    const networkURL: Network = "quicknet"
    return (
        <div>
            {/* Main Content: Shared Files (The exciting part!) */}
            <VaultList />

            {/* Tools Area */}
            <TabView>
                <Tab title={"🔒 新しく作る / 共有する"}>
                    <FileEncrypt network={networkURL} />
                </Tab>
                <Tab title={"🔓 開ける (復号)"}>
                    <FileDecrypt network={networkURL} />
                </Tab>
                <Tab title={"📤 手動アップロード"}>
                    <FileShare network={networkURL} />
                </Tab>
                <Tab title={"🏥 システム状態"}>
                    <HealthView />
                </Tab>
            </TabView>
        </div>
    )
}

export { App }
