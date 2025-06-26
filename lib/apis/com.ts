if (!window.AIWIDGETS_SOURCES)
    window.AIWIDGETS_SOURCES = {};

type ChangeListener = (name: string, data: any) => void;

/**
 * This class is used for communication between the different ai widgets.
 */
export class Communicator {
    private name: string;
    private dependencies: string[];

    /**
     * This class is used for communication between the different ai widgets.
     * @param name The name of the source this Communicator provides (Will be provided for other Communicators to depend on)
     * @param dependencies The names of the sources this Communicator depends on (Will provide data from the sources on request and trigger events if one source changes)
     */
    constructor(name: string, dependencies: string[], getData: () => any, onchange: ChangeListener) {
        window.AIWIDGETS_SOURCES[name] = this;
        this.name = name;
        this.dependencies = dependencies;
        this.getData = getData;
        this.onchange = onchange;
    }

    /**
     * This function will be called by other communicators to get the current state of a widget.
     */
    getData(): any { return null };

    /**
     * This event is called when a dependency changes its state.
     * @param name The dependency that changed
     * @param data The state from the dependency
     */
    onchange(name: string, data: any) { }

    /**
     * Calls getData for all the dependencies and assembles an object with the name of the dependency as the key and the data.
     */
    getDependencies(): Record<string, any> {
        let out = {};
        for (let d of this.dependencies) {
            out[d] = window.AIWIDGETS_SOURCES[d].getData();
        }
        return out;
    }
    /**
     * Calls getData for the dependencies with the name and assembles an object with the name of the dependency as the key and the data.
     */
    getDependency(name: string): any {
        return window.AIWIDGETS_SOURCES[name].getData();
    }

    getName(): string {
        return this.name;
    }

    /**
     * This function needs to be called to inform observers of changes
     */
    changed() {
        let that = this;
        for (let s in window.AIWIDGETS_SOURCES) {
            let source = window.AIWIDGETS_SOURCES[s];
            if (source.dependencies.indexOf(this.name) != -1)
                source.onchange(that.name, that.getData());
        }
    }
}

export function registerCommunicator(name: string, dependencies: string[], getData: () => any, onchange: ChangeListener): Communicator {
    return new Communicator(name, dependencies, getData, onchange);
}