import React from 'react';
import {ReelCore} from './ReelCore';
import {SCENES} from './scenes';

export const Reel: React.FC<{audio?: boolean; overlays?: boolean}> = (props) => <ReelCore scenes={SCENES} {...props} />;
