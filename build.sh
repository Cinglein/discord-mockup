echo "bin-target-triple = \"x86_64-unknown-linux-gnu\"" >> Cargo.toml
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc
cargo build --release
ghead -n -1 Cargo.toml > temp.txt
mv temp.txt Cargo.toml
