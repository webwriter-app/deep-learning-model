import { LitElementWw } from '@webwriter/lit';
import { FeatureTransformation } from '../../model/dataset/feature';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../model/tflib";
const tf = await getTF();

export abstract class OutputElement extends LitElementWw {
    abstract setTensor(tensor:TF.Tensor, transform: FeatureTransformation): Promise<void>;
}

export abstract class InputElement extends OutputElement {
    abstract getTensor(transform: FeatureTransformation) : Promise<TF.Tensor<TF.Rank>>;
}