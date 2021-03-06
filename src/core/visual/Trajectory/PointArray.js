import VisualTrajectoryModelAbstract from "./Abstract";
import {deg2rad} from "../../algebra";
import { sim } from "../../Simulation";

export default class VisualTrajectoryPointArray extends VisualTrajectoryModelAbstract
{
    constructor(trajectory, config) {
        super(trajectory, config);

        this.referenceFrame = sim.starSystem.getReferenceFrame(config.referenceFrame);
        this.showAhead = config.showAhead;
        this.showBehind = config.showBehind;
        this.trailPeriod = config.trailPeriod;

        this.minCos = Math.cos(deg2rad(config.maxAngle || 2));
        this.minStep = config.minStep || 180;
        this.threeObj.position.set(0, 0, 0);

        this.initVertices();
    }

    select() {
        super.select();
        this.showAhead = true;
        this.showBehind = true;
    }

    deselect() {
        super.deselect();
        this.showAhead = this.config.showAhead;
        this.showBehind = this.config.showBehind;
    }

    render(epoch) {
        super.render(epoch);

        const positionEpoch = this.getPositionEpoch(epoch);

        if (positionEpoch === false) {
            this.threeObj.visible = false;
            return;
        }

        const endingBrightness = 0.4;
        const originPos = this.referenceFrame.getOriginPositionByEpoch(epoch);
        let points = [];
        let colors = [];

        for (let i = 0; i < this.positions.length; ++i) {
            if (this.epochs[i] < positionEpoch - this.trailPeriod) {
                if (this.showBehind) {
                    points.push(this.positions[i]);
                    colors.push(0);
                }
                if (this.epochs[i+1] > positionEpoch - this.trailPeriod) {
                    points.push(
                        this.trajectory.getPositionByEpoch(positionEpoch - this.trailPeriod, this.referenceFrame)
                    );
                    colors.push(0);
                }
            } else if (this.epochs[i] < positionEpoch) {
                points.push(this.positions[i]);
                colors.push(1 - (positionEpoch - this.epochs[i]) / this.trailPeriod);
            } else if (this.epochs[i] > positionEpoch && this.showAhead) {
                points.push(this.positions[i]);
                colors.push(0);
            }

            if ((this.epochs[i] < positionEpoch)
                && (this.epochs[i+1] >= positionEpoch)
            ) {
                const pos = this.trajectory.getPositionByEpoch(positionEpoch, this.referenceFrame);
                points.push(pos);
                points.push(pos);
                colors.push(1);
                colors.push(0);
            }
        }

        this.updateGeometry(points, colors, endingBrightness);

        this.threeObj.quaternion.copy(this.referenceFrame.getQuaternionByEpoch(epoch).toThreejs());
        this.setPosition(originPos);
    }

    findPointByEpoch(epoch) {
        let low  = 0;
        let high = this.epochs.length - 1;
        let idx = Math.floor((low + high) / 2);

        do {
            if (this.epochs[idx] < epoch) {
                low = idx;
            } else if (this.epochs[idx] > epoch) {
                high = idx;
            } else {
                return idx;
            }
            idx = Math.floor((low + high) / 2)
        } while (idx != low);

        return (epoch - this.epochs[idx] > this.epochs[idx + 1] - epoch)
            ? idx + 1
            : idx;
    }

    initVertices() {
        const traj = this.trajectory;
        let step = this.minStep;
        let curEpoch = traj.minEpoch;
        let curState = traj.getStateByEpoch(curEpoch, this.referenceFrame);
        let curVelocity = curState.velocity.unit_();

        this.positions = [curState.position];
        this.epochs = [curEpoch];
        let i = 1;

        while (curEpoch < traj.maxEpoch) {
            let lastState;
            let lastEpoch;
            let lastDrMag;
            let isIncreasing = null;
            let stepsLeft = 20;
            while (true) {
                const nextEpoch = (curEpoch + step > traj.maxEpoch)
                    ? traj.maxEpoch
                    : curEpoch + step;
                step = nextEpoch - curEpoch;
                const newState = traj.getStateByEpoch(nextEpoch, this.referenceFrame);
                const dr = newState._position.sub(curState._position);
                const drMag = dr.mag;
                let angleCos = dr.dot(curVelocity) / drMag;

                if (nextEpoch != traj.maxEpoch) {
                    const nextNextEpoch = (nextEpoch + step > traj.maxEpoch)
                        ? traj.maxEpoch
                        : nextEpoch + step;
                    const nextNewState = traj.getStateByEpoch(nextNextEpoch, this.referenceFrame);
                    const nextDr = nextNewState._position.sub(newState._position);
                    angleCos = Math.min(angleCos, dr.dot(nextDr) / drMag / nextDr.mag);
                }

                // angle is too big
                if (angleCos < this.minCos) {
                    if (isIncreasing === true) {
                        break;
                    }
                    step /= 2;
                    isIncreasing = false;
                // angle is acceptable
                } else {
                    lastState = newState;
                    lastEpoch = nextEpoch;
                    lastDrMag = drMag;
                    if (isIncreasing === false || nextEpoch === traj.maxEpoch) {
                        break;
                    }
                    step *= 2;
                    isIncreasing = true;
                }

                --stepsLeft;
                if (stepsLeft === 0 || Math.abs(step) < this.minStep) {
                    step = this.minStep * Math.sign(step);
                    if (lastState === undefined) {
                        lastState = newState;
                        lastEpoch = nextEpoch;
                        lastDrMag = drMag;
                    }
                    break;
                }
            }

            this.epochs[i] = lastEpoch;
            this.positions[i] = lastState.position;

            curState = lastState;
            curVelocity = curState.velocity.unit_();
            curEpoch = lastEpoch;
            i++;
        }
    }
}
