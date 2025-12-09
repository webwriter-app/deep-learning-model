import { LitElementWw } from '@webwriter/lit';
import { FeatureTransformation } from '../../lib/dataset/feature';

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export abstract class OutputElement extends LitElementWw {
    abstract setTensor(tensor:TF.Tensor, transform: FeatureTransformation): Promise<void>;
}

export abstract class InputElement extends OutputElement {
    abstract getTensor(transform: FeatureTransformation) : Promise<TF.Tensor<TF.Rank>>;
}