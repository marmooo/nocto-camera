base_dir=${HOME}/workspace
emsdk_dir=${base_dir}/emsdk  # 3.1.61
opencv_dir=${base_dir}/opencv  # 4.10.0
build_dir=${opencv_dir}/platforms/js

# You can specify the following options:
  # --simd \
  # --threads \
source ${emsdk_dir}/emsdk_env.sh
python ${build_dir}/build_js.py ${opencv_dir}/build_wasm --build_wasm \
  --cmake_option "\
    -DBUILD_ZLIB=OFF \
    -DBUILD_opencv_calib3d=OFF \
    -DBUILD_opencv_dnn=OFF \
    -DBUILD_opencv_features2d=OFF \
    -DBUILD_opencv_flann=OFF \
    -DBUILD_opencv_photo=OFF" \
  --config opencv_js.config_min.py \
  --disable_single_file \
  --clean_build_dir \
  --opencv_dir ${opencv_dir} \
  --emscripten_dir ${emsdk_dir}/upstream/emscripten
