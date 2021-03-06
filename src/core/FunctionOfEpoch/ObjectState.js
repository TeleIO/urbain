import FunctionOfEpochAbstract from "./Abstract";
import { sim } from "../Simulation";

export default class FunctionOfEpochObjectState extends FunctionOfEpochAbstract
{
    constructor(objectId, referenceFrame) {
        super();
        this.objectId = objectId;
        this.referenceFrame = referenceFrame;
    }

    evaluate(epoch) {
        return sim.starSystem.getObject(this.objectId).trajectory.getStateByEpoch(epoch, this.referenceFrame);
    }
}
