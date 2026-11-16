# Deep Learning Model (`@webwriter/deep-learning-model@2.0.0`)
[License: MIT](LICENSE) | Version: 2.0.0

A set of blocks to create, train and evaluate deep learning models.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| MNIST Image To Number | `@webwriter/deep-learning-model/snippets/MNIST-Image-to-Number.html` |



## `WebwriterFeatureEngineering` (`<webwriter-feature-engineering>`)
A widget that allows feature engineering on a dataset

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-feature-engineering.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-feature-engineering.js"></script>
<webwriter-feature-engineering></webwriter-feature-engineering>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/deep-learning-model
```

```html
<link href="@webwriter/deep-learning-model/widgets/webwriter-feature-engineering.css" rel="stylesheet">
<script type="module" src="@webwriter/deep-learning-model/widgets/webwriter-feature-engineering.js"></script>
<webwriter-feature-engineering></webwriter-feature-engineering>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterFeatureEngineering.options` | `object` | - | `{ editMode: { type: "select" as const, label: (widget: Labelled) => widget.msg("Edit permissions"), options: [ {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")}, {value: "read", label: (widget: Labelled) => widget.msg("Read only")}, {value: "feat", label: (widget: Labelled) => widget.msg("Feature settings only")}, {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")}, ], }, }` | ✗ |
| `WebwriterFeatureEngineering.actions` | `object` | - | `{ deleteDataset: { label: (widget: Labelled) => widget.msg("Delete dataset"), confirm: (widget: Labelled) => widget.msg("Delete this dataset?"), intent: "danger" as const, }, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `limit` (`limit`) | `number` | The number of samples used for the dataset | `1000` | ✓ |
| `editMode` (`editMode`) | `"edit"\|"feat"\|"read"\|"hidden"` | What students will be able to edit in the explorable. Ranging from "edit" = everything, "feat" = only feature settings, "read" = read only, to "hidden" = invisible to the students. | `"edit"` | ✓ |
| `fieldProps` | - | - | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `deleteDataset` | - | -
| `getDataset` | Returns the current dataset in both raw and tensor form | -
| `isReady` | Checks whether the dataset is ready to be used | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Events
| Name | Description |
| :--: | :---------: |
| change | Fired when the dataset changes. Detail contains { dataset: Dataset, tensorDataset: TransformedDataset } |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, custom CSS properties, or CSS parts.*


## `WebwriterModelDesigning` (`<webwriter-model-designing>`)
A widget to design AI models using a visual editor.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-designing.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-designing.js"></script>
<webwriter-model-designing></webwriter-model-designing>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/deep-learning-model
```

```html
<link href="@webwriter/deep-learning-model/widgets/webwriter-model-designing.css" rel="stylesheet">
<script type="module" src="@webwriter/deep-learning-model/widgets/webwriter-model-designing.js"></script>
<webwriter-model-designing></webwriter-model-designing>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterModelDesigning.options` | `object` | - | `{ featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")}, editMode: { type: "select" as const, label: (widget: Labelled) => widget.msg("Edit permissions"), options: [ {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")}, {value: "read", label: (widget: Labelled) => widget.msg("Read only")}, {value: "layer", label: (widget: Labelled) => widget.msg("Layer properties only")}, {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")}, ], }, maxModelParameters: {type: Number, min: 1, max: 1000000, step: 100, label: (widget: Labelled) => widget.msg("Max model parameters")}, maxLayerParameters: {type: Number, min: 1, max: 100000, step: 10, label: (widget: Labelled) => widget.msg("Max layer parameters")}, }` | ✗ |
| `WebwriterModelDesigning.actions` | `object` | Delete removes the selected layer or connection. It has no button in the editor's drawer. | `{ deleteSelection: {label: (widget: Labelled) => widget.msg("Delete selected"), shortcut: ["Delete"], hidden: true}, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `featureWidgetId` (`featureWidgetId`) | `string` | Stores the reference id of the widget where the dataset is used from | - | ✓ |
| `editMode` (`editMode`) | `"edit"\|"layer"\|"read"\|"hidden"` | What students will be able to edit in the explorable. Ranging from "edit" = everything, "layer" = only layer settings, "read" = read only, to "hidden" = invisible to the students. | `"edit"` | ✓ |
| `maxModelParameters` (`maxModelParameters`) | `number` | The maximum number of total parameters allowed for training the model. Only checked by the training widget. | `100000` | ✓ |
| `maxLayerParameters` (`maxLayerParameters`) | `number` | The maximum number of parameters allowed per layer to allow training the model. | `10000` | ✓ |
| `currentCanvas` | `ModelEditor` | Reference to the current model editor canvas | - | ✗ |
| `layers` | `LayerState[]` | The layers of the design that the editor shows. | `[]` | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `deleteSelection` | Removes the selected layer or connection. Declines the key where the editor does not allow it. | -
| `zoomIn` | Zoom the canvas in | -
| `zoomOut` | Zoom the canvas out | -
| `zoomReset` | Reset the zoom of the canvas | -
| `getModel` | Exports the current model design | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, events, custom CSS properties, or CSS parts.*


## `WebwriterModelTraining` (`<webwriter-model-training>`)
A widget to train models designed in the model designing widget using datasets created in the feature engineering widget.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-training.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-training.js"></script>
<webwriter-model-training></webwriter-model-training>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/deep-learning-model
```

```html
<link href="@webwriter/deep-learning-model/widgets/webwriter-model-training.css" rel="stylesheet">
<script type="module" src="@webwriter/deep-learning-model/widgets/webwriter-model-training.js"></script>
<webwriter-model-training></webwriter-model-training>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterModelTraining.options` | `object` | - | `{ featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")}, modelWidgetId: {type: "reference" as const, selector: "webwriter-model-designing", label: (widget: Labelled) => widget.msg("Design source")}, editMode: { type: "select" as const, label: (widget: Labelled) => widget.msg("Edit permissions"), options: [ {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")}, {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")}, ], }, currentBackend: { type: "select" as const, label: (widget: Labelled) => widget.msg("Preferred backend"), options: [ {value: "cpu", label: (widget: Labelled) => widget.msg("CPU")}, {value: "webgl", label: (widget: Labelled) => widget.msg("WebGL (GPU)")}, ], }, cache: {type: Boolean, label: (widget: Labelled) => widget.msg("Cache training samples")}, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `featureWidgetId` (`featureWidgetId`) | `string` | The feature engineering widget to use as data source for training the model. | - | ✓ |
| `modelWidgetId` (`modelWidgetId`) | `string` | The model design widget to use as model source for training. | - | ✓ |
| `cache` (`cache`) | `boolean` | If true, the transformed training samples will be cached for faster training. | - | ✓ |
| `currentBackend` (`currentBackend`) | `"webgl" \| "cpu"` | The prefered tfjs backend | `"webgl"` | ✓ |
| `editMode` (`editMode`) | `"edit"\|"hidden"` | "edit" means that students can use the widget to train a model while "hidden" means the widget will be invisible to student but the trained models can be used by other widgets. | `"edit"` | ✓ |
| `modelVersions` | `Record<string, string>` | - | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `buildModel` | Builds the complete tfjs model using the layers from the model design widget. It sets the correct input names for the input layers as "in_<feature>". The output layers dependency graph is build and the loss is applied to the output tensor for training. | -
| `getModel` | Returns the model for named checkpoints for other widgets to use. | `name: string`
| `getAvailableModels` | Returns the available model checkpoints | -
| `initModel` | Initializes the model for training and preps the UI. | -
| `training` | Runs the tf training loop and keeps the UI up-to-date | -
| `saveCurrentModel` | Saves the current model as a checkpoint for other widgets to use later. | `name: string`

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Events
| Name | Description |
| :--: | :---------: |
| finished | Fired when the training process has finished. |
| epoch | Fired after each epoch during training. |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public slots, custom CSS properties, or CSS parts.*


## `WebwriterModelPrediction` (`<webwriter-model-prediction>`)
A widget to run inference using a trained model and features created in the feature engineering widget.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-prediction.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-prediction.js"></script>
<webwriter-model-prediction></webwriter-model-prediction>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/deep-learning-model
```

```html
<link href="@webwriter/deep-learning-model/widgets/webwriter-model-prediction.css" rel="stylesheet">
<script type="module" src="@webwriter/deep-learning-model/widgets/webwriter-model-prediction.js"></script>
<webwriter-model-prediction></webwriter-model-prediction>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterModelPrediction.options` | `object` | - | `{ featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")}, modelWidgetId: {type: "reference" as const, selector: "webwriter-model-training", label: (widget: Labelled) => widget.msg("Model source")}, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `featureWidgetId` (`featureWidgetId`) | `string` | The id of the feature engineering widget to use as input. | - | ✓ |
| `modelWidgetId` (`modelWidgetId`) | `string` | The id of the model training widget to use as model source. | - | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


## `WebwriterModelEvaluation` (`<webwriter-model-evaluation>`)
A widget that allows evaluating a trained model using various tests.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-evaluation.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/deep-learning-model/widgets/webwriter-model-evaluation.js"></script>
<webwriter-model-evaluation></webwriter-model-evaluation>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/deep-learning-model
```

```html
<link href="@webwriter/deep-learning-model/widgets/webwriter-model-evaluation.css" rel="stylesheet">
<script type="module" src="@webwriter/deep-learning-model/widgets/webwriter-model-evaluation.js"></script>
<webwriter-model-evaluation></webwriter-model-evaluation>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterModelEvaluation.options` | `object` | - | `{ featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")}, modelWidgetId: {type: "reference" as const, selector: "webwriter-model-training", label: (widget: Labelled) => widget.msg("Model source")}, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `featureWidgetId` (`featureWidgetId`) | `string` | The id of the feature engineering widget to use as feature source. | - | ✓ |
| `modelWidgetId` (`modelWidgetId`) | `string` | The id of the model training widget to use as model source. | - | ✓ |

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
*Generated with @webwriter/build@1.14.0*