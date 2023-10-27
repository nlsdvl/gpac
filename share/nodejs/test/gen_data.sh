#!/bin/bash
DATADIR=$0/../data
mkdir $DATADIR
cd $DATADIR
gpac avgen:dur=0.04 -o frame.yuv
gpac avgen:dur=1 -o beep.wav
gpac -i frame.yuv:size=1280x720 c=h265 -o frame.hvc
