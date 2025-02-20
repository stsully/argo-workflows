import {Observable} from 'rxjs';
import * as models from '../../models';
import {NODE_PHASE} from '../../models';

const managedNamespaceKey = 'managedNamespace';
const currentNamespaceKey = 'current_namespace';
const maxK8sResourceNameLength = 253;
const k8sNamingHashLength = 10;

export const Utils = {
    statusIconClasses(status: string): string {
        let classes = [];
        switch (status) {
            case NODE_PHASE.ERROR:
            case NODE_PHASE.FAILED:
                classes = ['fa-times-circle', 'status-icon--failed'];
                break;
            case NODE_PHASE.SUCCEEDED:
                classes = ['fa-check-circle', 'status-icon--success'];
                break;
            case NODE_PHASE.RUNNING:
                classes = ['fa-circle-notch', 'status-icon--running', 'status-icon--spin'];
                break;
            case NODE_PHASE.PENDING:
                classes = ['fa-clock', 'status-icon--pending', 'status-icon--slow-spin'];
                break;
            default:
                classes = ['fa-clock', 'status-icon--init'];
                break;
        }
        return classes.join(' ');
    },

    shortNodeName(node: {name: string; displayName: string}): string {
        return node.displayName || node.name;
    },

    toObservable<T>(val: T | Observable<T> | Promise<T>): Observable<T> {
        const observable = val as Observable<T>;
        if (observable && observable.subscribe && observable.catch) {
            return observable as Observable<T>;
        }
        return Observable.from([val as T]);
    },

    tryJsonParse(input: string) {
        try {
            return (input && JSON.parse(input)) || null;
        } catch {
            return null;
        }
    },

    isWorkflowSuspended(wf: models.Workflow): boolean {
        if (!wf || !wf.spec) {
            return false;
        }
        if (wf.spec.suspend !== undefined && wf.spec.suspend) {
            return true;
        }
        if (wf.status && wf.status.nodes) {
            for (const node of Object.values(wf.status.nodes)) {
                if (node.type === 'Suspend' && node.phase === 'Running') {
                    return true;
                }
            }
        }
        return false;
    },

    isWorkflowRunning(wf: models.Workflow): boolean {
        if (!wf || !wf.spec) {
            return false;
        }
        return wf.status.phase === 'Running';
    },

    set managedNamespace(value: string) {
        if (value) {
            localStorage.setItem(managedNamespaceKey, value);
        } else {
            localStorage.removeItem(managedNamespaceKey);
        }
    },

    get managedNamespace() {
        return this.fixLocalStorageString(localStorage.getItem(managedNamespaceKey));
    },

    fixLocalStorageString(x: string): string {
        // empty string is valid, so we cannot use `truthy`
        if (x !== null && x !== 'null' && x !== 'undefined') {
            return x;
        }
    },

    onNamespaceChange(value: string) {
        // noop
    },

    set currentNamespace(value: string) {
        if (value != null) {
            localStorage.setItem(currentNamespaceKey, value);
        } else {
            localStorage.removeItem(currentNamespaceKey);
        }
        this.onNamespaceChange(this.currentNamespace);
    },

    get currentNamespace() {
        // we always prefer the managed namespace
        return this.managedNamespace || this.fixLocalStorageString(localStorage.getItem(currentNamespaceKey));
    },

    // return a namespace, favoring managed namespace when set
    getNamespace(namespace: string) {
        return this.managedNamespace || namespace;
    },

    // return a namespace, never return null/undefined, defaults to "default"
    getNamespaceWithDefault(namespace: string) {
        return this.managedNamespace || namespace || this.currentNamespace || 'default';
    },

    ensurePodNamePrefixLength(prefix: string): string {
        const maxPrefixLength = maxK8sResourceNameLength - k8sNamingHashLength;

        if (prefix.length > maxPrefixLength - 1) {
            return prefix.substring(0, maxPrefixLength - 1);
        }

        return prefix;
    },

    // getPodName returns a deterministic pod name
    getPodName(workflowName: string, nodeName: string, templateName: string, nodeID: string): string {
        if (workflowName === nodeName) {
            return workflowName;
        }

        let prefix = `${workflowName}-${templateName}`;
        prefix = this.ensurePodNamePrefixLength(prefix);

        const hash = createFNVHash(nodeName);
        return `${prefix}-${hash}`;
    }
};

const createFNVHash = (input: string): number => {
    const data = new Buffer(input);

    let hashint = 2166136261;

    /* tslint:disable:no-bitwise */
    for (const character of data) {
        hashint = hashint ^ character;
        hashint += (hashint << 1) + (hashint << 4) + (hashint << 7) + (hashint << 8) + (hashint << 24);
    }

    return hashint >>> 0;
};
