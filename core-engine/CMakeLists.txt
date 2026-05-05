# ============================================================================
# Beulrock C++ Core Engine — CMake Build Configuration
# ============================================================================
#
# Builds the beulrock-engine binary that communicates with the Next.js
# backend via stdin/stdout JSON I/O (the --stdin protocol).
#
# Dependencies:
#   - OpenSSL 1.1.1+ / 3.x  (EVP crypto APIs)
#   - nlohmann/json           (header-only, fetched or vendored)
#   - pthreads                (POSIX threads, usually available)
#
# Build:
#   mkdir build && cd build
#   cmake .. -DCMAKE_BUILD_TYPE=Release
#   cmake --build . -j$(nproc)
#
# The binary will be at: build/beulrock-engine
# ============================================================================

cmake_minimum_required(VERSION 3.16)
project(beulrock-engine VERSION 1.0.0 LANGUAGES CXX)

# ── C++ Standard ────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Compiler flags ──────────────────────────────────────────────────────────
# Aggressive optimisations for Release, debug info for RelWithDebInfo
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    add_compile_options(-O2 -DNDEBUG)
elseif(CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    add_compile_options(-O2 -g -DNDEBUG)
else()
    add_compile_options(-g -O0)
endif()

# Warnings as errors (best-effort; adjust if your compiler is noisy)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# ── Find dependencies ───────────────────────────────────────────────────────

# OpenSSL (provides libcrypto for SHA-256, HMAC-SHA256 via EVP)
find_package(OpenSSL REQUIRED COMPONENTS Crypto)

# Threads (pthread)
find_package(Threads REQUIRED)

# ── nlohmann/json ──────────────────────────────────────────────────────────
# Strategy: use a vendored single-header in include/nlohmann/json.hpp.
# If that file is present we simply add the include directory.
# Otherwise, fall back to FetchContent to download the header.
#
# The GitHub Actions CI workflow is responsible for placing the header
# into include/nlohmann/json.hpp before running cmake.

if(EXISTS "${CMAKE_SOURCE_DIR}/include/nlohmann/json.hpp")
    message(STATUS "Using vendored nlohmann/json from include/")
    add_library(nlohmann_json INTERFACE)
    target_include_directories(nlohmann_json SYSTEM INTERFACE "${CMAKE_SOURCE_DIR}/include")
else()
    message(STATUS "nlohmann/json not vendored — fetching via FetchContent …")
    include(FetchContent)
    FetchContent_Declare(
        json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG        v3.11.3
        GIT_SHALLOW    TRUE
    )
    FetchContent_MakeAvailable(json)
    # The target exported by the json CMake is nlohmann_json::nlohmann_json
    set(NLOHMANN_JSON_TARGET nlohmann_json::nlohmann_json)
endif()

# ── Main executable ─────────────────────────────────────────────────────────
add_executable(beulrock-engine src/main.cpp)

target_include_directories(beulrock-engine
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(beulrock-engine
    PRIVATE
        OpenSSL::Crypto
        Threads::Threads
        ${NLOHMANN_JSON_TARGET}
)

# ── Install rule (optional — copies binary to bin/) ────────────────────────
install(TARGETS beulrock-engine RUNTIME DESTINATION bin)

# ── Output directories ─────────────────────────────────────────────────────
set_target_properties(beulrock-engine PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
)
