# Ai,Blocks (`@webwriter/ai-blocks@0.0.1`)
[License: MIT](LICENSE) | Version: 0.0.1

A set of blocks to create, train and evaluate deep learning models.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| MNIST Image To Number | `@webwriter/ai-blocks/snippets/MNIST-Image-to-Number.html` |



## `AiWidgetsFeatures` (`<webwriter-feature-engineering>`)


### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-feature-engineering.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-feature-engineering.js"></script>
<webwriter-feature-engineering></webwriter-feature-engineering>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/ai-blocks
```

```html
<link href="@webwriter/ai-blocks/widgets/webwriter-feature-engineering.css" rel="stylesheet">
<script type="module" src="@webwriter/ai-blocks/widgets/webwriter-feature-engineering.js"></script>
<webwriter-feature-engineering></webwriter-feature-engineering>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `samplesSave` (`samplesSave`) | `string` | The original decompressed data in a json string with format of RawSample[] | - | ✓ |
| `fieldProps` (`fieldProps`) | `Record<string, FieldProp>` | Stores the settings of the feature columns | - | ✓ |
| `limit` (`limit`) | `number` | The number of samples used for the dataset | `1000` | ✓ |
| `isInitiated` (`isInitiated`) | `boolean` | - | `false` | ✗ |
| `editMode` (`editMode`) | `"edit"\|"feat"\|"read"\|"hidden"` | What students will be able to edit in the explorable. Ranging from "edit" = everything, "feat" = only feature settings, "read" = read only, to "hidden" = invisible to the students. | `"edit"` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `renderSelectDataset` | - | -
| `renderTableHeader` | - | -
| `renderFieldValues` | - | `fieldName: string`
| `renderFieldTypeSelector` | - | `fieldName: string`
| `handleDataset` | Called when a new dataset is provided | `data: Array<Record<string, string>>`, `errors: Array<any>`, `meta: any`
| `getDataset` | - | -
| `updateTensorDataset` | Called everytime settings change to generate the new tensor dataset. | -
| `handleHeaderClick` | Switches to the clicked tab | `e: Event`
| `deleteDataset` | - | -
| `handleSizeChange` | Called when the limit is chanded | -
| `handleFeatureSettingsChange` | Called when the user changes the feature settings | `settings: Record<string, any>`
| `_triggerChanged` | Tells listening widgets when the dataset changed | -
| `isReady` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Events
| Name | Description |
| :--: | :---------: |
| change | - |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, custom CSS properties, or CSS parts.*


## `AiWidgetsDesigns` (`<webwriter-model-designing>`)


### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-designing.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-designing.js"></script>
<webwriter-model-designing></webwriter-model-designing>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/ai-blocks
```

```html
<link href="@webwriter/ai-blocks/widgets/webwriter-model-designing.css" rel="stylesheet">
<script type="module" src="@webwriter/ai-blocks/widgets/webwriter-model-designing.js"></script>
<webwriter-model-designing></webwriter-model-designing>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `state` (`state`) | `string` | Stores the state of the model editor as a json string | - | ✓ |
| `featureWidgetId` (`featureWidgetId`) | `string` | Stores the reference id of the widget where the dataset is used from | - | ✓ |
| `refSelect` | `AiWidgetsReferenceSelect` | - | - | ✗ |
| `editMode` (`editMode`) | `"edit"\|"layer"\|"read"\|"hidden"` | What students will be able to edit in the explorable. Ranging from "edit" = everything, "layer" = only layer settings, "read" = read only, to "hidden" = invisible to the students. | `"edit"` | ✓ |
| `maxModelParameters` (`maxModelParameters`) | `number` | The maximum number of total parameters allowed for training the model. Only checked by the training widget. | `100000` | ✓ |
| `maxLayerParameters` (`maxLayerParameters`) | `number` | The maximum number of parameters allowed per layer to allow training the model. | `10000` | ✓ |
| `currentCanvas` | `ModelEditor` | - | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `zoomIn` | - | -
| `zoomOut` | - | -
| `zoomReset` | - | -
| `getModel` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `AiWidgetsTraining` (`<webwriter-model-training>`)


### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-training.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-training.js"></script>
<webwriter-model-training></webwriter-model-training>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/ai-blocks
```

```html
<link href="@webwriter/ai-blocks/widgets/webwriter-model-training.css" rel="stylesheet">
<script type="module" src="@webwriter/ai-blocks/widgets/webwriter-model-training.js"></script>
<webwriter-model-training></webwriter-model-training>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `featureWidgetId` (`featureWidgetId`) | `string` | - | - | ✓ |
| `featureSelect` | - | - | - | ✗ |
| `modelWidgetId` (`modelWidgetId`) | `string` | - | - | ✓ |
| `modelSelect` | - | - | - | ✗ |
| `startTrainingBtn` | - | - | - | ✗ |
| `resetTrainingBtn` | - | - | - | ✗ |
| `trainingMetricsDiv` | - | - | - | ✗ |
| `speed` | `HTMLSpanElement` | - | - | ✗ |
| `memory` | `HTMLSpanElement` | - | - | ✗ |
| `error` | `HTMLSpanElement` | - | - | ✗ |
| `cache` (`cache`) | `boolean` | - | - | ✓ |
| `currentBackend` (`currentBackend`) | `"webgl" \| "cpu"` | The prefered tfjs backend | `"webgl"` | ✓ |
| `modelVersions` (`modelVersions`) | `Record<string, string>` | Stores the model jsons with a name like "best" or "epoch-20" for loading by the inference and test widgets | `{}` | ✓ |
| `editMode` (`editMode`) | `"edit"\|"hidden"` | "edit" means that students can use the widget to train a model while "hidden" means the widget will be invisible to student but the trained models can be used by other widgets. | `"edit"` | ✓ |
| `optimizer` | `SlSelect` | - | - | ✗ |
| `lr` | `SlInput` | - | - | ✗ |
| `momentum` | `SlInput` | - | - | ✗ |
| `batch` | `SlInput` | - | - | ✗ |
| `epochs` | `SlInput` | - | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `showError` | - | `err: string`
| `hideError` | - | -
| `changeOptimizer` | - | -
| `setHyperParamsActive` | - | `active: boolean`
| `resolveOutput` | Used to recursively connect the inputs via the layers to the output nodes. | `layer: Layer`, `inputs: Record<string, TF.SymbolicTensor>`, `resolvedLayers: Record<number, any>`
| `buildModel` | Builds the complete tfjs model using the layers from the model design widget. It sets the correct input names for the input layers as "in_<feature>". The output layers dependency graph is build and the loss is applied to the output tensor for training. | -
| `lossStringToFunction` | - | `loss: string`
| `updateGraph` | - | -
| `getModel` | Returns the model for named checkpoints for other widgets to use. | `name`
| `getAvailableModels` | Returns the available model checkpoints | -
| `initModel` | Initializes the model for training and preps the UI. | -
| `training` | Runs the tf training loop and keeps the UI up-to-date | -
| `saveCurrentModel` | Saves the current model as a checkpoint for other widgets to use later. | `name`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Events
| Name | Description |
| :--: | :---------: |
| finished | - |
| epoch | - |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, custom CSS properties, or CSS parts.*


## `AiWidgetsInference` (`<webwriter-model-prediction>`)


### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-prediction.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-prediction.js"></script>
<webwriter-model-prediction></webwriter-model-prediction>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/ai-blocks
```

```html
<link href="@webwriter/ai-blocks/widgets/webwriter-model-prediction.css" rel="stylesheet">
<script type="module" src="@webwriter/ai-blocks/widgets/webwriter-model-prediction.js"></script>
<webwriter-model-prediction></webwriter-model-prediction>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `featureWidgetId` (`featureWidgetId`) | `string` | - | - | ✓ |
| `featureSelect` | `AiWidgetsReferenceSelect` | - | - | ✗ |
| `modelWidgetId` (`modelWidgetId`) | `string` | - | - | ✓ |
| `modelSelect` | `AiWidgetsReferenceSelect` | - | - | ✗ |
| `modelName` | `SlSelect` | - | - | ✗ |
| `selectedModelName` (`selectedModelName`) | `string` | - | - | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `getModelSelect` | Renders the model select field allowing the user to change the model checkpoint that is used for inference. | -
| `getFeatureInputs` | Renders the left input fields which the user can edit and which values are fed into the model periodically. | -
| `getFeatureOutputs` | Renders the right output fields which are generated by the model output periodically. | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `AiWidgetsTest` (`<webwriter-model-evaluation>`)


### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-evaluation.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/ai-blocks/widgets/webwriter-model-evaluation.js"></script>
<webwriter-model-evaluation></webwriter-model-evaluation>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/ai-blocks
```

```html
<link href="@webwriter/ai-blocks/widgets/webwriter-model-evaluation.css" rel="stylesheet">
<script type="module" src="@webwriter/ai-blocks/widgets/webwriter-model-evaluation.js"></script>
<webwriter-model-evaluation></webwriter-model-evaluation>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `featureWidgetId` (`featureWidgetId`) | `string` | - | - | ✓ |
| `featureSelect` | `AiWidgetsReferenceSelect` | - | - | ✗ |
| `modelWidgetId` (`modelWidgetId`) | `string` | - | - | ✓ |
| `modelSelect` | `AiWidgetsReferenceSelect` | - | - | ✗ |
| `modelName` | `SlSelect` | - | - | ✗ |
| `testSelect` | `SlSelect` | - | - | ✗ |
| `testContainer` | `HTMLDivElement` | - | - | ✗ |
| `selectedModelName` (`selectedModelName`) | `string` | - | - | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `getModelSelect` | Renders the model select field allowing the user to change the model checkpoint that is used for testing. | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.9.0*