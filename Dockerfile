FROM node:6.2.2-onbuild

ENV CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
RUN echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
RUN sudo apt-get update && sudo apt-get install google-cloud-sdk

RUN echo "Installed google cloud sdk..."