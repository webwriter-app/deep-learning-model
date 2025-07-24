import * as tf from '@tensorflow/tfjs';
import { LitElementWw } from '@webwriter/lit';
import { FeatureTransformation } from '../../lib/dataset/feature';

export abstract class OutputElement extends LitElementWw {
    abstract setTensor(tensor:tf.Tensor, transform: FeatureTransformation): Promise<void>;
}

export abstract class InputElement extends OutputElement {
    abstract getTensor(transform: FeatureTransformation) : Promise<tf.Tensor<tf.Rank>>;
}